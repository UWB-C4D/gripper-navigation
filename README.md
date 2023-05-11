# ArUco-based navigation
This repository contains a combination of python scripts and REXYGEN configuration for ArUco-based marker navigation suitable for gripper navigation. The marker recognition is done in Python script, and gripper navigation utilizes the REXYGEN system. The AruCo detector contains a MAVLink interface and thus can be used for several applications.


## Installation
The AruCo detector runs on Linux OS. It was tested in Debian 9 and 10. It doesn't require a graphical user interface. Also, Raspberry Pi 3 or 4 is suitable hardware with Raspberry Pi OS.

### Prerequisites
```bash
apt update
apt install python3 python3-pip python3-opencv
```

** MAVLink **
```bash
DISABLE_MAVNATIVE=True pip3 install -U pymavlink
```

** RxPy **
```bash
pip3 install rx
```

** REXYGEN **
Follow the guideline https://www.rexygen.com/getting-started-with-industrial-pc/

** Optional dependencies **
```bash
pip3 install pickle5 urwid
```

### Temporary filesystem for OpenCV
To store images on temporary storage available via the web, you must create a RAM disk according to the instructions below. (https://www.jamescoyle.net/how-to/943-create-a-ram-disk-in-linux)

```bash
mkdir /rex/www/opencv
```
then add the following to `fstab`

```bash
nano /etc/fstab

## Temporary filesystem for OpenCV
tmpfs   /rex/www/opencv tmpfs  nodev,nosuid,noexec,nodiratime,size=50M   0     0
```

### Creating a service I follow the instructions here: 

Copy the `scripts/aruco-detector.service` file to `/etc/systemd/system`

```bash
ln -s /rex/scripts/drone-port/scripts/aruco-detector.service /etc/systemd/
```
See https://github.com/torfsen/python-systemd-tutorial


Start the service

```bash
systemctl daemon-reload
systemctl enable aruco-detector.service
systemctl start aruco-detector.service
```

### Show logs
```bash
journalctl -f --unit aruco-detector
```


## License
MIT license
