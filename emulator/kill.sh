#!/bin/bash

ps aux | grep "python script.py" | grep -- "--id" | grep -- "--projectID" | awk '{print $2}' | while read pid; do
  echo "Killing process $pid..."
  kill -9 $pid
done

echo "All matching processes have been terminated."