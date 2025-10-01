# Change Log

## 1.1.0

- Implements [#443](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/443): Show CPU execution time (from connection start and between breakpoints).
- Fixes [#159](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/159): Documentation updates - GDB sets off assertion when debugging with NUCLEO-F746ZG.
- Fixes [#374](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/374): Documentation updates - Disassembly view interleaved with source code.
- Fixes [#439](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/439): Peripheral Inspector receives wrong SVD file path for secondary core of a multi-core connection.
- Updates included pyOCD distribution to v0.39.0
    - Set debugger protocol based on information from `*.cbuild-run.yml` file.
    - Fixes [#370](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/370):
        - Improve error messages for JTAG/SWD protocol errors.
        - Improve handling of attaching probe while pyOCD is waiting.
    - Fixes [#435](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/435): Increase number of transfer retries after WAIT response.
    - Fixes [#461](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/461): Unable to use GD-Link programmer in version 1.0.0. Fixes support for USB HID based probes without serial number.
    - Fixes [#472](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/472): Stop pyOCD if `*.cbuild-run.yml` file is missing.
    - Fixes [#473](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/473): Show warning when packs required by `*.cbuild-run.yml` file are missing.
    - Fixes [#504](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/504): pyOCD should extract file type from `*.cbuild-run.yml` descriptions.
    - Fixes semihosting support: Fix read when no data is available.

## 1.0.0

- Removes `Preview` status from extension.
- Fixes [#407](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/407): Warning pops up when using an absolute path in the launch config.
- Fixes [#428](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/428): `PERIPHERALS` view not shown when attaching to a running debug session.
- Implements [#357](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/357): Create extension variant for Windows on Arm (WoA).
- Updates included pyOCD distribution to v0.38.0
    - Implements [#313](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/313): Add CoreSight AP specific CSW handling for AHB-AP, AXI-AP, APB-AP.
    - Cortex-M: configure AP for cacheable access when cache is present.
    - Add support for SW breakpoints when cache is present.
    - Add more debug logging information for cbuild-run targets.
    - Fixes [#108](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/108): Flash algorithms - Relax memory layout rules and add RAM alignment and minimum stack size checking.
    - Fixes [#382](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/382): CMSIS-DAP probe: fix macOS HID read/write.
    - Fixes [#387](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/387): cbuild-run: use cbuild-run.yml parent folder as working directory for relative paths.
    - Fixes: Flash region builder - remove flash algorithm page size adjustment.

## 0.5.0

- **IMPORTANT**: This release updates the [license](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/blob/main/LICENSE) for the CMSIS Debugger extension from `Apache License 2.0` to `Apache License 2.0 and GNU General Public License v3.0 or later`.
- Adds [`arm-none-eabi-gdb` v14.3.1](https://artifacts.tools.arm.com/arm-none-eabi-gdb/14.3.1/) to CMSIS Debugger extension pack. This removes
the need to install the `GCC compiler for ARM CPUs` for a workspace using the
`Arm Tools Environment Manager` extension.
- Updates outdated documentation links in Change Log.

## 0.4.0

- Removes pseudo debugger types `cmsis-debug-pyocd` and `cmsis-debug-jlink`.
CMSIS debug launch configurations and tasks are managed by
[Arm CMSIS Solution extension](https://marketplace.visualstudio.com/items?itemName=Arm.cmsis-csolution)
since v1.54.0.  
If you need to manually set up a `gdbtarget` connection, then refer to
[CDT GDB Adapter extension](https://marketplace.visualstudio.com/items?itemName=eclipse-cdt.cdt-gdb-vscode).
- Updates [documentation](https://marketplace.visualstudio.com/items?itemName=Arm.vscode-cmsis-debugger).
- Updates included pyOCD distribution to v0.37.0.

## 0.3.1

- Fixed image links in [README](https://marketplace.visualstudio.com/items?itemName=Arm.vscode-cmsis-debugger).

## 0.3.0

- Switches away from `pre-release` distribution channel. Extension remains at `preview` status.
- Includes Microsoft® [`Serial Monitor`](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-serial-monitor)
in extension pack.
- Updates [README](https://marketplace.visualstudio.com/items?itemName=Arm.vscode-cmsis-debugger) with usage documentation.
- Updates included pyOCD distribution
    - Improves robustness of debug sequence execution.
    - Updates behavior when `cbuild-run` target clashes with an internally registered target, to overwrite.
    - Sets debugger clock based on the `debugger` node in `*.cbuilld-run.yml` file.

## 0.2.0

- **Important**: This release requires
[CMSIS-Toolbox v2.9.0](https://github.com/Open-CMSIS-Pack/cmsis-toolbox/releases/tag/2.9.0)
to function correctly. Update your workspace's `vcpkg-configuration.json` file accordingly.
- Updates [documentation](https://marketplace.visualstudio.com/items?itemName=Arm.vscode-cmsis-debugger).
- Implements [#238](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/238): Support
[`*.cbuild-run.yml`](https://open-cmsis-pack.github.io/cmsis-toolbox/YML-CBuild-Format/#file-structure-of-cbuild-runyml)
file changes in CMSIS-Toolbox v2.9.0.
- Updates included pyOCD distribution
    - Updates `*.cbuild-run.yml` support to changes in CMSIS-Toolbox 2.9.0.
    - Implements [#208](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/208):
    `--cbuild-run` target support in pyOCD subcommands.
    - Implements [#241](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/241):
    Use default values for CMSIS_PACK_ROOT if variable is not explicitly set.

## 0.1.1

- Fixes [#153](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/153): PATH variable in terminal sometimes
loses modifications from other extensions.
- Fixes [#155](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/155): Go-to-main in `initCommands` of the
`launch.json` leaves behind the breakpoint.
- Partially implements [#96](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/96): Enable Peripheral
Inspector.
    - Extracts first SVD file path found in `*.cbuild-run.yml` debug configuration file to automatically set up
  Peripheral Inspector.
- Adds initial version of extension [documentation](https://marketplace.visualstudio.com/items?itemName=Arm.vscode-cmsis-debugger).
- Updates included pyOCD distribution
    - Fixes [#133](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/133): Adds default memory map for
    Cortex-M devices.
    - Improves memory map creation and flash algorithms sorting.
    - Selects current processor core (for example used for flash programming) based on active gdb server connection.

## 0.1.0

- Updates included pyOCD distribution
    - Fixes [#92](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/92): `monitor reset halt` command
    fails for LPCXpresso55S69 if using CMSIS-Pack support in pyOCD.
    - Fixes [#93](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/93): Download to LPC55S69 flash with
    GDB and pyOCD ends in errors.
    - Fixes [#94](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/94): Cannot connect to
    NXP FRDM-K32L3A6 with pyOCD.
    - Fixes support for `<memory>` elements from CMSIS PDSC files.
    - Fixes progress bar output during program download.
    - Fixes handling of `__ap` variable in debug sequences.
    - Improves connection robustness and DP sticky error bits handling for temporary target communication losses and
    `__errorcontrol` usage (CMSIS debug descriptions). For example in reset scenarios.
    - Updates CMSIS-DAP probe detection (filters out Cypress KitProg3 bridge).
    - Extends and improves support for `*.cbuild-run.yml` debug configuration files.

## 0.0.3

- Fixes [#84](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/84): Cannot use cbuild-run files with
pyOCD without CMSIS_PACK_ROOT environment variable.
- Implements [#83](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/83): Make built-in pyOCD available
in VS Code terminals.
    - Note that there is a known issue with a pyOCD installation in Python virtual environments taking precedence over
    the built-in pyOCD variant.
- Updates included pyOCD distribution
    - Fixes [#91](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/91): "Zephyr kernel detected" warning
    in shipped pyOCD.
    - Fixes [#100](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/100): [macOS] - Cannot connect with
    pyOCD and ULINKplus. Fixes missing `libusb` for macOS.
    - Fixes [#126](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/126): Flash programming fails on
    devices where the flash memory's erased value is 0x00. Initializes XPSR register before executing flash algorithm
    function.
    - Fixes [#127](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/127): CoreSight root component
    discovery fails. Fixes how to address APv2.
    - Fixes [#128](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/128): Programming fails on LPC55S69
    when device is erased. Debugger no longer reads back programmed flash memory if `Verify` function is
    provided by flash algorithm.
    - Fixes [#131](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/131):
    AP access failure due to invalid security flags (SPROT).
    - Extends support for `*.cbuild-run.yml` debug configuration files.

## 0.0.2

- Removes [Arm Tools Environment Manager](https://marketplace.visualstudio.com/items?itemName=Arm.environment-manager)
from extension pack. Instead, README lists it as one of the recommended extensions to use with the Arm CMSIS Debugger.
- Fixes use of `${workspace}` to `${workspaceFolder}` in default debug configurations.
- Reduces and aligns default `initCommands` lists for pseudo debugger types `cmsis-debug-pyocd`
and `cmsis-debug-jlink`.
- Implements [#69](https://github.com/Open-CMSIS-Pack/vscode-cmsis-debugger/issues/69): Bring Debug Console to
front during connection.

## 0.0.1

- Initial release of extension pack on GitHub.
- Adds pseudo debugger types `cmsis-debug-pyocd` and `cmsis-debug-jlink`.
- Adds debug configuration providers for debugger type `gdbtarget` to resolve settings for pyOCD and Segger J-Link
GDB server connections.
- Contributes setting `cmsis`.`cbuildRunFile` to all debugger types (`*` debugger type).
