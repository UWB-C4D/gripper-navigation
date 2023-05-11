import os
import sys
from pathlib import Path
import cv2
import cv2.aruco  # pylint: disable=import-error
import numpy as np
import math
from PyRexExt import REX

CAMERA_DEV = '/dev/cam-gripper'
CALIB_PATH = Path(REX.RexDataPath)/'OV5648_calibration_parameters.yml'
PREVIEW_IMAGE_PATH = Path(REX.RexDataPath)/'../www/opencv/preview.png'
RESOLUTIONS = [(640, 480), (800, 600), (1280, 720),
               (1280, 960), (1920, 1080), (2592, 1944)]

init_OK = True
detector = None
old_show_video = False
counter = 1

# cSpell:disable
# TODO: Rozdelit do vice souboru
# cSpell:enable

on_windows = sys.platform == 'win32'

#--- 180 deg rotation matrix around the x axis
R_flip = np.zeros((3, 3), dtype=np.float32)
R_flip[0, 0] = 1.0
R_flip[1, 1] = -1.0
R_flip[2, 2] = -1.0


class ArucoDetector(object):
    """
    Skript na detekci jednoho ArUco markeru, ktery vraci polohu relativne ke středu kamery
    Inspirováno: 
    https://diydrones.com/m/blogpost?id=705844%3ABlogPost%3A2454830
    https://github.com/tizianofiorenzani/how_do_drones_work/blob/master/scripts/06_precise_landing.py
    """
    # cSpell:ignore rvec tvec

    def __init__(self,
                 calib_file_path='data/camera_calibration_parameters.yml',
                 camera_id=0,  # Camera ID in the system
                 camera_width=640,  # Desired image resolution, camera MUST support it
                 camera_height=480,
                 dictionary=cv2.aruco.DICT_6X6_50,  # ArUco dictionary
                 marker_length=100,  # Marker size in mm
                 save_image_path='data/preview.png'  # Where to save preview image
                 ):
        self.camera = {'cameraMatrix': [], 'distCoeffs': []}        
        self.dictionary = cv2.aruco.getPredefinedDictionary(dictionary)
        if not Path(calib_file_path).exists():
            raise ValueError(f'Camera calibration file does not exists at {calib_file_path}')
        param_file = cv2.FileStorage(calib_file_path, cv2.FILE_STORAGE_READ)
        self.camera['cameraMatrix'] = param_file.getNode("cameraMatrix").mat()
        self.camera['distCoeffs'] = param_file.getNode("distCoeffs").mat()
        if on_windows:
            self.cap = cv2.VideoCapture(camera_id, cv2.CAP_DSHOW)
        else:
            self.cap = cv2.VideoCapture(CAMERA_DEV)
        #-- Set the camera size as the one it was calibrated with
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, camera_width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, camera_height)
        self.marker_length = marker_length
        self.show_video = False
        # Save image function settings
        self.save_image = False
        self.save_image_path = str(Path(save_image_path))
        tmpPath = Path(save_image_path)
        suffix = Path(save_image_path).suffix
        self.save_image_temp_path = str(
            tmpPath.with_name('preview-tmp').with_suffix(suffix))
    
    # Calculates rotation matrix to euler angles
    # The result is the same as MATLAB except the order
    # of the euler angles ( x and z are swapped ).
    def rotationMatrixToEulerAngles(self,R):

        sy = math.sqrt(R[0, 0] * R[0, 0] + R[1, 0] * R[1, 0])

        singular = sy < 1e-6

        if not singular:
            x = math.atan2(R[2, 1], R[2, 2])
            y = math.atan2(-R[2, 0], sy)
            z = math.atan2(R[1, 0], R[0, 0])
        else:
            x = math.atan2(-R[1, 2], R[1, 1])
            y = math.atan2(-R[2, 0], sy)
            z = 0

        return np.array([x, y, z])

    def findArucoMarker(self, id_to_find=0):
        R = []
        rvec = []
        tvec = []
        id_index = -1
        found = True
        tvec_uav = [0, 0, 0]
        rvec_uav_euler = [0, 0, 0]
        ret, img = self.cap.read()

        # aruco.detectMarkers() requires gray image
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        corners, ids, rejectedImgPoints = cv2.aruco.detectMarkers(
            img_gray, self.dictionary)

        if ids is not None:
            for idx, val in enumerate(ids):
                if val == id_to_find:
                    id_index = idx
                    break

        # Pocitam s tim, že chci vědět polohy pouze pro jeden marker, i když 
        # jich uvidím více
        if id_index >= 0:  # if aruco marker detected
            #-- ret = [rvec, tvec, ?]
            #-- array of rotation and position of each marker in camera frame
            #-- rvec = [[rvec_1], [rvec_2], ...]    attitude of the marker respect to camera frame
            #-- tvec = [[tvec_1], [tvec_2], ...]    position of the marker in camera frame
            ret = cv2.aruco.estimatePoseSingleMarkers(corners,  self.marker_length,
                                                      self.camera['cameraMatrix'],
                                                      self.camera['distCoeffs'])  # For a single marker
            #-- Unpack the output, get only the first
            rvec, tvec = ret[0][id_index, 0, :], ret[1][id_index, 0, :]

            
            # Konverze z framu kamery do framu UAV
            # Kde je marker vuci dronu
            # x = y
            # y = -x
            # z = z
            # tvec_uav[0] = tvec[1]
            # tvec_uav[1] = -tvec[0]
            # tvec_uav[2] = tvec[2]

            tvec_uav = tvec

            # Prevod z vektoru rotace na rotacni matici
            R, jacobian = cv2.Rodrigues(rvec)
            rvec_uav_euler = self.rotationMatrixToEulerAngles(R)

            # Konverze z framu kamery do framu UAV
            # Kde je dron vuci markeru
            # rvec_uav_euler[0] = -rvec_uav_euler[0]
            # rvec_uav_euler[1] = -rvec_uav_euler[1]
            # rvec_uav_euler[2] = -rvec_uav_euler[2]
            
            
        else:   # if aruco marker is NOT detected
            found = False
            pass

        if self.show_video or self.save_image:
            imgMarker = img
            if id_index >= 0:
                imgMarker = cv2.aruco.drawDetectedMarkers(
                    img, corners, ids, (0, 255, 0))
                # axis length 100 can be changed according to your requirement
                imgMarker = cv2.aruco.drawAxis(imgMarker,
                                               self.camera['cameraMatrix'], self.camera['distCoeffs'], rvec, tvec, 100)
            if self.show_video:
                cv2.imshow("Preview", imgMarker)
                cv2.waitKey(20)
            if self.save_image:
                cv2.imwrite(self.save_image_temp_path, imgMarker)
                os.replace(self.save_image_temp_path, self.save_image_path)

        return found, tvec_uav, rvec_uav_euler


def resetOutputs():
    REX.y0.v = False
    REX.y1.v = 0
    REX.y2.v = 0
    REX.y3.v = 0
    REX.y4.v = 0


def init():
    global detector, init_OK
    init_OK = True
    resolution = None
    # Skript není volaný z REXYGENu
    if REX.u0.v == None:
        
        REX.u0.v = True  # ENABLE        
        REX.u1.v = 0     # camera_id
        REX.u2.v = 20    # marker_length
        REX.u3.v = 12    # marker_id
        REX.u4.v = 4     # resolution

        REX.u14.v = 0    # modulo
        REX.u15.v = False# preview image

    try:
        resolution = RESOLUTIONS[REX.u4.v]
    except:
        resolution = (640, 480)
        REX.TraceWarning(
            f"Resolution at index {REX.u4.v} does not exist! Using default 640x480")

    calib_path = CALIB_PATH \
        .with_name(f'{CALIB_PATH.stem}_{resolution[0]}x{resolution[1]}{CALIB_PATH.suffix}')
    if not calib_path.exists():
        REX.TraceError("Camera calibration file not found.")
        init_OK = False
    try:
        detector = ArucoDetector(
            calib_file_path=str(calib_path),
            camera_id=REX.u1.v,
            marker_length=REX.u2.v,
            camera_width=resolution[0],
            camera_height=resolution[1],
            save_image_path=str(PREVIEW_IMAGE_PATH))

        # Test if resolution is set correctly
        ret, frame = detector.cap.read()
        if frame.shape[1] != resolution[0] or frame.shape[0] != resolution[1]:
            REX.TraceWarning(
                f"Camera resolution is not supported! Wanted {resolution[0]}x{resolution[1]}, got {frame.shape[1]}x{frame.shape[0]}")        
    except Exception as e:
        REX.TraceError(str(e))
        init_OK = False
    if init_OK:
        REX.TraceWarning(
                f"ArUco detector initialized. Camera will capture {frame.shape[1]}x{frame.shape[0]} images.")                
    REX.Trace("Init done.")
    return


# the main procedure is executed repeatedly (once in each sampling period)
def main():
    global detector, old_show_video, counter
    ENABLE = REX.u0.v
    id_to_find = REX.u3.v
    img_mod = REX.u14.v

    # Save images
    if ENABLE and init_OK:
        detector.save_image = REX.u15.v
    elif detector is not None:
        detector.save_image = False

    if img_mod > 0 and detector is not None and detector.save_image:
        if counter % img_mod == 0:
            detector.save_image = True
            counter = 1
        else:
            detector.save_image = False
            counter = counter + 1

    if ENABLE and init_OK:
        try:
            # detector.show_video = REX.u15.v
            found, tvec_uav, rvec_uav_euler = detector.findArucoMarker(id_to_find=id_to_find)
            REX.y0.v = found
            if found:
                REX.y1.v = tvec_uav[0]
                REX.y2.v = tvec_uav[1]
                REX.y3.v = tvec_uav[2]
                REX.y4.v = rvec_uav_euler[0]
                REX.y5.v = rvec_uav_euler[1]
                REX.y6.v = rvec_uav_euler[2]
        except Exception as e:
            REX.TraceError(str(e))
            REX.y0.v = False
    else:
        resetOutputs()
    return


def exit():
    resetOutputs()
    if detector:
        if detector.cap is not None:
            detector.cap.release()
        if detector.show_video:
            cv2.destroyAllWindows()
    REX.Trace("PYTHON EXIT")
    return


if __name__ == "__main__":
    # Zmením CWD na adresář kde je uložený skript.
    # K němu se pak relativně budou volat všechny cesty
    os.chdir(str(Path(__file__).parent))
    detector = ArucoDetector(
        calib_file_path=REX.RexDataPath+'/OV5648_calibration_parameters_1920x1080.yml',
        save_image_path='/rex/www/opencv/preview.png',
        camera_id=0,
        marker_length=40,
        camera_width=1920,
        camera_height=1080)
    detector.save_image = True
    while True:
        detector.findArucoMarker(id_to_find=20)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
    detector.cap.release()
    cv2.destroyAllWindows()
