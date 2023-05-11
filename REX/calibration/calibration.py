import os
import sys
from pathlib import Path
import numpy as np
import cv2
import time
import cv2.aruco # pylint: disable=import-error
from PyRexExt import REX  # pylint: disable=import-error

PREVIEW_IMAGE_PATH = Path(REX.RexDataPath)/'../www/opencv/preview.png'
PREVIEW_IMAGE_TMP_PATH = Path(REX.RexDataPath)/'../www/opencv/preview-tmp.png'
RESOLUTIONS = [(640, 480), (800, 600), (1280, 720),
               (1280, 960), (1920, 1080), (2592, 1944)]
DICTIONARY = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_6X6_250)

init_OK = False
board = None
img_board = None
camera = None
resolution = None
calib_file_path = None
save_image = False
last_image = None
on_windows = sys.platform == 'win32'

CAMERA_ID = 0

allCorners = []
allIds = []


def init():
    global board, img_board, camera, init_OK, allIds, allCorners, resolution
    allIds = []
    allCorners = []
    init_OK = True
    REX.y0.v = False
    REX.y15.v = False    
    try:
        resolution = RESOLUTIONS[REX.u5.v]
    except:
        resolution = (640, 480)
        REX.TraceWarning(
            f"Resolution at index {REX.u5.v} does not exist! Using default 640x480")

    board = cv2.aruco.CharucoBoard_create(REX.u1.v, REX.u2.v, REX.u3.v, REX.u4.v, DICTIONARY)
    img_board = board.draw((200*REX.u1.v, 200*REX.u2.v))  # pixels

    try:
        if on_windows:
            camera = cv2.VideoCapture(CAMERA_ID, cv2.CAP_DSHOW)
        else:
            camera = cv2.VideoCapture(CAMERA_ID)

        #-- Set the camera size as the one it was calibrated with
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, resolution[0])
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, resolution[1])

        # Test if resolution is set correctly
        ret, frame = camera.read()
        if frame.shape[1] != resolution[0] or frame.shape[0] != resolution[1]:
            REX.TraceWarning(
                f"Camera resolution is not supported! Wanted {resolution[0]}x{resolution[1]}, got {frame.shape[1]}x{frame.shape[0]}")    
    except Exception as e:
        REX.TraceError(str(e))
        init_OK = False
    
    if init_OK:
        REX.TraceWarning(
                f"Camera will capture {frame.shape[1]}x{frame.shape[0]} images.")


# the main procedure is executed repeatedly (once in each sampling period)
def main():    
    global allCorners, allIds, save_image, last_image
    if REX.u6.v:
        save_image = True
    if init_OK:
        if REX.u0.v:
            ret, img = camera.read()
            # aruco.detectMarkers() requires gray image
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            last_image = gray
            markers = cv2.aruco.detectMarkers(gray, DICTIONARY)

            if len(markers[0]) > 0:
                count, charucoCorners, charucoIds = cv2.aruco.interpolateCornersCharuco(
                    markers[0], markers[1], gray, board)
                cv2.aruco.drawDetectedMarkers(gray, markers[0], markers[1])
                cv2.putText(gray, f'Snimek: {len(allIds)}', (30, 65),
                            1, 1.5, (0, 255, 0), 2, cv2.FONT_HERSHEY_PLAIN)

                if save_image and charucoCorners is not None and charucoIds is not None and len(charucoCorners) > 10:
                    allCorners.append(charucoCorners)
                    allIds.append(charucoIds)
                    save_image = False

            cv2.imwrite(str(PREVIEW_IMAGE_TMP_PATH), gray)
            os.replace(PREVIEW_IMAGE_TMP_PATH, PREVIEW_IMAGE_PATH)
    REX.y1.v = len(allIds)

    if REX.u7.v:
        #Calibration fails for lots of reasons. Release the video if we do
        try:
            imsize = last_image.shape
            retval, cameraMatrix, distCoeffs, rvecs, tvecs = cv2.aruco.calibrateCameraCharuco(
                allCorners, allIds, board, imsize, None, None)
            REX.Trace(str(cameraMatrix))
            REX.Trace(str(distCoeffs))
            calib_file = Path(REX.RexDataPath)/f"OV5648_calibration_parameters_{resolution[0]}x{resolution[1]}.yml"            
            if calib_file.exists():
                calib_file.unlink()

            param_file = cv2.FileStorage(str(calib_file), cv2.FILE_STORAGE_WRITE)
            param_file.write("cameraMatrix", cameraMatrix)
            param_file.write("distCoeffs", distCoeffs)
            # note you *release* you don't close() a FileStorage object
            param_file.release()
            REX.y0.v = True
        except Exception as e:
            REX.TraceError(str(e))
            REX.y0.v = -1
            REX.y15.v = True
    return


# the exit procedure is executed once when the task is correctly terminated
# (system shutdown, downloading new control algorithm, etc.)
def exit():
    # Releasing the resource    
    if camera:
        camera.release()
    
    cv2.destroyAllWindows()
    return

if __name__ == "__main__":    
    
    REX.u0.v = True
    REX.u1.v = 6
    REX.u2.v = 6
    REX.u3.v = 0.075
    REX.u4.v = 0.055
    REX.u5.v = 0

    init()

    while True:
        main()
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
    camera.release()
    cv2.destroyAllWindows()