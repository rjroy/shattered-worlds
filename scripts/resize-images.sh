#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Usage: $0 <image-file> [<image-file> ...]"
    exit 1
fi

for img in "$@"; do
    if [ ! -f "$img" ]; then
        echo "Error: File '$img' does not exist."
        continue
    fi

    echo "Resizing '$img' to max height 600px..."
    magick "$img" -resize "x600" "$img.tmp" 
    if [ $? -eq 0 ]; then
        echo "Successfully resized '$img'"
    else
        echo "Error resizing '$img'"
        continue
    fi
    cwebp "$img.tmp" -m 6 -q 80 -o "${img%.*}.webp"
    if [ $? -eq 0 ]; then
        echo "Successfully converted '$img'"
    else
        echo "Error converted '$img'"
        continue
    fi
    # Cleanup temporary file and maybe original if you want
    rm "$img.tmp"
    if [ $img != "${img%.*}.webp" ]; then
        rm "$img"
    fi
done
