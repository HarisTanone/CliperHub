#!/bin/bash

# Suppress all MediaPipe and protobuf logs
export GLOG_minloglevel=3
export TF_CPP_MIN_LOG_LEVEL=3
export MEDIAPIPE_DISABLE_GPU=1
export GLOG_logtostderr=0
export GLOG_stderrthreshold=3

# Run server and filter out protobuf messages
python main.py 2>&1 | grep -v "node {" | grep -v "calculator:" | grep -v "input_stream:" | grep -v "output_stream:" | grep -v "options {" | grep -v "indexes_mapping:" | grep -v "refinement {" | grep -v "z_refinement {" | grep -v "type:" | grep -v "executor {" | grep -v "input_side_packet:"
