#!/usr/bin/env python3

# Disable "Bare exception" warning
# pylint: disable=W0702

import rx.operators as op
import rx
from pymavlink.mavutil import mavlink as MAV
from pymavlink import mavutil
import program
from PyRexExt import REX
import signal
import traceback
import time
import sys
import math
from datetime import datetime
import os
# Use common MAVLINK dialect
os.environ['MAVLINK_DIALECT'] = 'common'
# Force use of MAVLINK protocol v 2.0
os.environ['MAVLINK20'] = '1'


ADDRESS = '127.0.0.1'
PORT = '15550'
DEFAULT_PERIOD = 0.1  # s

REX.verbose = False


class MAVLink_Client:
    time_start = time.time()

    def __init__(self, address, port=15550, source_system=254, source_component=0xAD):
        if not address:
            raise ValueError('Address must be defined!')
        self.address = address
        self.port = port
        self.source_system = source_system
        self.source_component = source_component
        # MAVLink communication interface
        self.master = None
        self.last_msg = None
        # Observable which periodically send the HB message
        self.hb_timer = None

        # List of properties which are changed over MAVLink commands.
        self.cmd_debug = False  # If True the TaskScheduler will send diagnostic data over MAVlink
        self.period = None
        self._send_trace_messages_over_mavlink_enabled = False

    def init(self):
        self.reset()
        self.master = mavutil.mavlink_connection(
            f'udpout:{self.address}:{self.port}', source_system=self.source_system, source_component=self.source_component)
        REX.Trace(f'Opening UDP connection to {self.address}:{self.port}')
        self.send_heartbeat()
        self.hb_timer = rx.timer(0, 1).subscribe(self.send_heartbeat)

    def send_heartbeat(self, *args):
        if not self.master:
            return
        # https://mavlink.io/en/messages/common.html#HEARTBEAT
        self.master.mav.heartbeat_send(
            # Vehicle or component type. For a flight controller component the vehicle type (quadrotor, helicopter, etc.). For other components the component type (e.g. camera, gimbal, etc.). This should be used in preference to component id for identifying the component type.
            type=0,  # MAV_TYPE_GENERIC
            autopilot=8,  # MAV_AUTOPILOT_INVALID
            base_mode=0,  # System mode bitmap.
            custom_mode=0,  # A bitfield for use for autopilot-specific flags
            system_status=0,  # System status flag.
            mavlink_version=3
        )
        # REX.Trace(f'[{time.time() - MAVLink_Client.time_start:06.3f}] HB send')

    def process_message(self, msg):
        """
        Override to extend the message processing
        return 1 if not implemented to log the message
        """
        return 1

    def receive_commands(self, *args):
        if not self.master:
            return
        """
        Process commands from MAVLink and store the values to the REX global object for futher asynchronous processing
        """
        msg = self.master.recv_match()
        if not msg:
            return
        self.last_msg = msg
        tstamp = msg._timestamp - MAVLink_Client.time_start
        if msg.get_type() != 'HEARTBEAT':
            REX.TraceInfo('Command received', msg)
        if msg.get_type() == 'HEARTBEAT':
            # REX.Trace(f'[{tstamp:06.3f}] HB recv {msg.get_srcSystem()}:{msg.get_srcComponent()}')
            pass
        elif msg.command == MAV.MAV_CMD_USER_1:
            REX.u0.v = msg.param1
            REX.u1.v = msg.param2
            REX.u2.v = msg.param3
            REX.u3.v = msg.param4
            REX.u4.v = msg.param5
            REX.u5.v = msg.param6
            REX.u6.v = msg.param7
            self.master.mav.command_ack_send(
                command=MAV.MAV_CMD_USER_1,
                result=MAV.MAV_RESULT_ACCEPTED
            )
        elif msg.command == MAV.MAV_CMD_USER_2:
            REX.u7.v = msg.param1
            REX.u8.v = msg.param2
            REX.u9.v = msg.param3
            REX.u10.v = msg.param4
            REX.u11.v = msg.param5
            REX.u12.v = msg.param6
            REX.u13.v = msg.param7
            self.master.mav.command_ack_send(
                command=MAV.MAV_CMD_USER_2,
                result=MAV.MAV_RESULT_ACCEPTED
            )
        elif msg.command == MAV.MAV_CMD_USER_3:
            REX.u14.v = msg.param1
            REX.u15.v = msg.param2
            self.master.mav.command_ack_send(
                command=MAV.MAV_CMD_USER_3,
                result=MAV.MAV_RESULT_ACCEPTED
            )
        elif msg.command == MAV.MAV_CMD_USER_4:
            self.cmd_debug = bool(msg.param1)
            REX.Trace(f'[{tstamp:06.3f}] Debug changed to {self.cmd_debug}')
            self.send_trace_messages_over_mavlink(bool(msg.param2))
            if msg.param3 == MAV.MAV_SEVERITY_DEBUG:
                REX.verbose = True
            else:
                REX.verbose = False
            self.master.mav.command_ack_send(
                command=MAV.MAV_CMD_USER_4,
                result=MAV.MAV_RESULT_ACCEPTED
            )
        elif msg.command == MAV.MAV_CMD_SET_MESSAGE_INTERVAL:
            # Round to milliseconds
            self.period = round(msg.param2, 3)
            self.master.mav.command_ack_send(
                command=MAV.MAV_CMD_SET_MESSAGE_INTERVAL,
                result=MAV.MAV_RESULT_ACCEPTED
            )
        else:
            if self.process_message(msg) == 1:
                REX.Trace(f'[{tstamp:.3f}][NOT SUPPORTED]', msg)

        # MAV_CMD_SET_MESSAGE_INTERVAL (511 ) https://mavlink.io/en/messages/common.html#MAV_CMD_SET_MESSAGE_INTERVAL

    def send_results(self, *args):
        pass

    def reset(self):
        if self.hb_timer:
            self.hb_timer.dispose()
        if self.master:
            self.master.close()
        self.master = None

    def exit(self, *args):
        REX.TraceWarning('Exit called! Closing socket and disposing timers.')
        self.reset()

    def _send_statustext(self, text, severity=MAV.MAV_SEVERITY_DEBUG):
        if self.master:            
            self.master.mav.statustext_send(
                severity=severity,
                # MAX 50 characters
                text=text.encode('utf-8')
            )

    def send_trace_messages_over_mavlink(self, enable):
        self._send_trace_messages_over_mavlink_enabled = enable

        # Once override standard logging functions
        if enable and not hasattr(REX, 'old_Trace'):
            REX.old_Trace = REX.Trace
            REX.old_TraceError = REX.TraceError
            REX.old_TraceInfo = REX.TraceInfo
            REX.old_TraceWarning = REX.TraceWarning

            def Trace(*args):
                if REX.verbose and self._send_trace_messages_over_mavlink_enabled:
                    self._send_statustext(
                        ' '.join([str(x) for x in args]), MAV.MAV_SEVERITY_DEBUG)
                REX.old_Trace(*args)

            REX.Trace = Trace

            def TraceInfo(*args):
                if self._send_trace_messages_over_mavlink_enabled:
                    self._send_statustext(
                        ' '.join([str(x) for x in args]), MAV.MAV_SEVERITY_INFO)
                REX.old_TraceInfo(*args)
            REX.TraceInfo = TraceInfo

            def TraceWarning(*args):
                if self.send_trace_messages_over_mavlink:
                    self._send_statustext(
                        ' '.join([str(x) for x in args]), MAV.MAV_SEVERITY_WARNING)
                REX.old_TraceWarning(*args)
            REX.TraceWarning = TraceWarning

            def TraceError(*args):
                if self.send_trace_messages_over_mavlink:
                    self._send_statustext(
                        ' '.join([str(x) for x in args]), MAV.MAV_SEVERITY_ERROR)
                REX.old_TraceError(*args)
            REX.TraceError = TraceError
        if enable:
            REX.TraceInfo('MAV Logging enabled')

    def _exit_on_signal(self):
        self.exit()
        sys.exit(0)


class TaskDebug:
    def __init__(self):
        # All times are in milliseconds
        self.last_time = 0
        self.avg_time = 0
        self.max_time = 0
        self.no_of_samples = 0

    def send_over_mavlink(self, mavlink_master):
        if mavlink_master:
            # tstamp in usec
            tstamp = int((time.time() - MAVLink_Client.time_start)*1000000)
            mavlink_master.mav.debug_vect_send(
                name='diag______'.encode('utf-8'),
                time_usec=tstamp,
                x=self.last_time,
                y=self.avg_time,
                z=self.max_time,
            )

    def push_last_time(self, t):
        t = t*1000  # Conversion to milliseconds

        self.last_time = t
        self.max_time = max(self.max_time, t)

        # Moving average calculation
        n = self.no_of_samples
        self.avg_time = self.avg_time + 1 / (n + 1) * (t - self.avg_time)
        self.no_of_samples += 1

    def reset(self):
        self.last_time = 0
        self.avg_time = 0
        self.max_time = 0
        self.no_of_samples = 0

    def __str__(self):
        return f'LAST: {self.last_time:.3f} AVG: {self.avg_time:.3f} MAX: {self.max_time:.3f}'


class TaskScheduler:
    def __init__(self, mavlink, task_debug, program, period=1):
        self.mavlink = mavlink
        self.task_debug = task_debug
        # File with the same interface as for the REXYGEN PYTHON blok
        # init(), main() and exit() public functions
        self.program = program

        self._diagnostics_enabled = False
        self._recv_interval = None
        self._exit_called = False

        #  In case of period change the init function of the mavlink interface is not called
        # If some error occurs the mavlink connection is reinitialized
        self._init_mavlink_called = False
        self.period = period

        # Main loop call init(), then main() periodically
        self.subject = rx.subject.BehaviorSubject(period)
        self.subject.pipe(
            op.do_action(self._init_mavlink),
            op.do_action(self._wait_for_heartbeat),
            op.do_action(self._start_command_processing),
            op.do_action(self._call_init),
            op.map(self._on_period),
            op.switch_latest(),
            op.map(self._call_main),
            op.map(self._send_tstamp),
            op.map(self._check_period),
            op.catch(self._on_error),
            op.retry()
        ).subscribe(
            # on_next = lambda i: print("Received {0}".format(i)),
            # on_error = lambda e: print("Error Occurred: {0}".format(e)),
            on_completed=self._call_exit,
        )

        signal.signal(signal.SIGINT, self._on_SIG_signal)
        signal.signal(signal.SIGTERM, self._on_SIG_signal)

    def change_period(self, period):
        self._call_exit()
        self.subject.on_next(period)

    def diagnostics(self, enable):
        if enable and not self._diagnostics_enabled:
            self.task_debug.reset()
        self._diagnostics_enabled = enable

    def _init_mavlink(self, *args):
        self.mavlink.init()

    def _start_command_processing(self, *args):
        self._process_commands()
        if self._recv_interval:
            self._recv_interval.dispose()
        self._recv_interval = rx.interval(0.05).subscribe(
            on_next=self._process_commands,
            on_error=self._on_error
        )

    def _wait_for_heartbeat(self, *args):
        REX.TraceInfo('Waiting for HEARTBEAT from target device ...')
        self.mavlink.master.wait_heartbeat()
        REX.TraceInfo('Done')

    def _process_commands(self, *args):
        try:
            self.mavlink.receive_commands()
            self.diagnostics(self.mavlink.cmd_debug)
        except OSError as e:
            REX.TraceInfo('Mavlink called after socket was closed')
            pass

    def _call_init(self, *args):
        self._exit_called = False
        try:
            REX.Trace(f'Init called.')
            self.program.init()
        except Exception as err:
            raise err

    def _call_main(self, *args):
        if self._exit_called:
            return -1
        start = time.time()
        tstamp = -1
        try:
            self.program.main()
            self.mavlink.send_results()
            tstamp = time.time() - start
            self.task_debug.push_last_time(tstamp)
        except Exception as err:
            self.task_debug.push_last_time(time.time() - start)
            raise err
        return tstamp

    def _call_exit(self, *args):
        self._exit_called = True
        REX.Trace(f'Exit called.')
        try:
            if self._recv_interval:
                self._recv_interval.dispose()
            self.program.exit()
        except Exception as err:
            raise err

    def _send_tstamp(self, tstamp):
        if self._diagnostics_enabled:
            self.task_debug.send_over_mavlink(self.mavlink.master)
            REX.Trace(self.task_debug)
        return tstamp

    def _on_error(self, ex, src):
        REX.TraceError(traceback.format_exc())
        self._call_exit()
        # Check if mavlink connection is OK, if not reset
        try:
            self.mavlink.send_heartbeat()
        except:
            self.mavlink.reset()
        return src

    def _on_period(self, period):
        self.period = period
        REX.TraceInfo(f'Main refresh period is {period}s')
        if period == 0:  # As fast as possible
            return rx.never()
        elif period == -1:  # Stop
            return rx.empty()
        else:
            return rx.timer(0, period)

    def _check_period(self, *args):
        if self.mavlink.period is not None and self.mavlink.period != self.period:
            self.change_period(self.mavlink.period)

    def _on_SIG_signal(self, *args):
        self._call_exit()
        self.mavlink.exit()
        sys.exit(0)


class ArUco_MAVlink(MAVLink_Client):
    # def __init__(self, *args):
    #     super().__init__(*args)

    def process_message(self,msg):
        # if msg.command == MAV.MAV_CMD_SET_MESSAGE_INTERVAL:
        #     pass
        # else:
        #     return 1
        return 1

    def send_results(self, *args):
        super().send_results(*args)
        if self.last_msg and self.last_msg.get_type() != 'HEARTBEAT':
            # tstamp in usec
            tstamp = int((time.time() - MAVLink_Client.time_start)*1000000)
            self.master.mav.debug_vect_send(
                name='aruco'.encode('utf-8'),
                time_usec=tstamp,
                x=REX.u0.v,
                y=REX.u3.v,
                z=REX.u2.v
            )

        # https://mavlink.io/en/messages/common.html#VISION_POSITION_ESTIMATE
        if REX.y0.v:  # FOUND
            self.master.mav.vision_position_estimate_send(
                usec=int((time.time() - MAVLink_Client.time_start) *
                         1000000),  # Time stamp when picture was taken
                x=REX.y1.v,  # Local X position
                y=REX.y2.v,  # Local Y position
                z=REX.y3.v,  # Local Z position
                roll=REX.y4.v,  # Roll angle
                pitch=REX.y5.v,  # Pitch angle
                yaw=REX.y6.v,    # Yaw angle
                # covariance=[],
                # reset_counter=0
            )
            r2d = 180.0/math.pi
            roll_deg = REX.y4.v * r2d
            pitch_deg = REX.y5.v * r2d
            yaw_deg = REX.y6.v * r2d
            REX.Trace(
                f'VISION_POSITION_ESTIMATE [{REX.y1.v:.3f},{REX.y2.v:.3f},{REX.y3.v:.3f}][{roll_deg:.3f},{pitch_deg:.3f},{yaw_deg:.3f}]')

# Python script for the Python Demo Service

if __name__ == '__main__':

    REX.TraceInfo('Starting up ...')

    mav = None
    try:
        mav = ArUco_MAVlink(ADDRESS)
        task_debug = TaskDebug()
        task_scheduler = TaskScheduler(
            mavlink=mav, task_debug=task_debug, program=program, period=DEFAULT_PERIOD)

        # run() waits util timer is finished which will never happen
        # thus wait till KILL is invoked
        # alternative is `input("Press any key to quit\n")`
        rx.interval(1000).run()
    except Exception as err:
        REX.TraceError(traceback.format_exc())
        if mav:
            mav.exit()
