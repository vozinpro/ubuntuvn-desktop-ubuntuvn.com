#!/bin/bash

dconf dump /org/gnome/shell/extensions/TaskBar/ >$HOME/taskbar.dconf
if [ ! -f $HOME/taskbar.dconf ]; then
  zenity --info --text 'Export Settings Failed!'
else
  zenity --info --text 'Export Settings Successful!'
fi
