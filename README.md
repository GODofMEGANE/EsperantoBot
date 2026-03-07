# EsperantoBot

## nodeのバージョンが新しすぎるとvoskが入らなくて悲しいので
nvm install 18.4
nvm use 18.4

## arm版にしないといけないので
wget https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-linux-aarch64-0.3.45.zip
cp vosk-linux-aarch64-0.3.45/libvosk.so node_modules/vosk/lib/linux-x86_64/libvosk.so
