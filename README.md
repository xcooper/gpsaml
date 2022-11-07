# The SAML addon for Globalprotect protocol

## Prerequisites
- openconnect: Windows can install this [here](https://openconnect.github.io/openconnect-gui/); other platforms can install by the package managers.
- sudo: Windows can install `gsudo` by `winget install gsudo`.

## How to run
This command ONLY give you the enchanted `openconnect` command.  Copy the output command and paste again to the terminal.

### Use source code
```
yarn run electron . -h vpn.some.com -g 'Taipei Somewhere'
```

### Build from source code and run
Take Windows as an example
```
yarn run electron-packager . gpsaml --platform=win32 --arch=x64
```

## Known Issues
- If you feel the network isn't working, please check route table first.  Sometime you need manually add route info.
