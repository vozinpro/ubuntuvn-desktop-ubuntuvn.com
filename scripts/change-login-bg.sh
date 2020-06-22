#!/bin/sh
if [ $EUID != 0 ]; then
    sudo "$0" "$@"
    exit $?
fi
workdir=/tmp

if [ ! -d ${workdir}/theme ]; then
  mkdir -p ${workdir}/theme
fi

gst=/usr/share/gnome-shell/gnome-shell-theme.gresource

for r in $(gresource list $gst); do
  gresource extract $gst $r >$workdir/${r#\/org\/gnome\/shell/}
done

bg=$(sudo -Hu $USER dbus-launch gsettings get org.gnome.desktop.background picture-uri)
file=$(echo $bg | cut -c9- | rev | cut -c2- | rev)

img=$(basename -a $file)

cd $workdir/"theme"

convert $file -channel RGBA -blur 0x26 blur.png

cd ".."

FILES=$(find "theme" -type f -printf "%P\n" | xargs -i echo "    <file>{}</file>")

cat <<EOF >"theme/gnome-shell-theme.gresource.xml"
<?xml version="1.0" encoding="UTF-8"?>
<gresources>
  <gresource prefix="/org/gnome/shell/theme">
$FILES
  </gresource>
</gresources>
EOF

(
  cd $workdir/"theme"
  if [ ! -f gnome-shell-theme.gresource ]; then
    rm gnome-shell-theme.gresource
  fi

  glib-compile-resources gnome-shell-theme.gresource.xml
)

sudo cp theme/gnome-shell-theme.gresource /usr/share/gnome-shell/

rm -rf $workdir/"theme"

zenity --info --text 'Login background reset successful!'
