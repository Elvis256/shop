#!/bin/bash
cd /home/elvis/shop/frontend
while true; do
  npm run dev
  echo "Next.js exited, restarting in 2 seconds..."
  sleep 2
done
