### ubuntuvn-desktop-ubuntuvn.com
# Ubuntuvn 3 gnome desktop extension
The Ubuntuvn desktop extension is the default desktop interface of Ubuntuvn gnome edition. Thís extension included some modules and works of existing extentions

Module included: material-shell@papyelgringo, extendedgestures@mpiannucci.github.com, YouTubeSearchProvider
Inspired by: simple-task-bar@fthx, TaskBar@c0ldplasma, dynamic-panel-transparency

Download Ubuntuvn 3 respin at https://ubuntuvn.com/download

## Install on Ubuntu 20.04

Open the terminal and execute commands:

`wget -O - https://ubuntuvn.com/ubuntuvnrespin.gpg.key|sudo apt-key add -`

You can separate above command to two commands:

`wget - https://ubuntuvn.com/ubuntuvnrespin.gpg.key`

`sudo apt-key add ubuntuvnrespin.gpg.key`

Add ubuntuvn respin to your apt source list

`echo "deb https://ubuntuvn.com/apt/debian/ focal main" | sudo tee /etc/apt/sources.list.d/ubuntuvnrespin.list`

Install Ubuntuvn desktop extension

`sudo apt update && sudo apt install -y ubuntuvn-desktop-extension`

Activate the extension

`gnome-extension enable ubuntuvn-desktop@ubuntuvn.com`
## Install on Gnome Extension

https://extensions.gnome.org/extension/3264/ubuntuvn-desktop/

## Install on other distro

`git clone https://github.com/vozinpro/ubuntuvn-desktop-ubuntuvn.com ~/.local/share/gnome-shell/extensions/`

Activate the extension

`gnome-extension enable ubuntuvn-desktop@ubuntuvn.com`
