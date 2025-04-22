#!/bin/bash
# Loop to execute Python scripts with different values of i
for i in {0..4}; do
    python script.py --id "$i" --projectID 13 &
done
# Wait for all background processes to finish
wait
echo "All scripts have finished execution."
