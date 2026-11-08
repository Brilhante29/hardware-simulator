# Alvo "simulate" para PlatformIO: compila e dá boot no firmware no emulador do Hardware Studio.
# No platformio.ini do seu projeto:
#   extra_scripts = post:/caminho/para/hardware-simulator/tools/platformio/simulate.py
# Depois:  pio run -t simulate          (tempo real, Ctrl+C para sair)
#          SIM_ARGS="--seconds 5 --pins" pio run -t simulate
import inspect
import os
Import("env")  # noqa: F821  (injetado pelo PlatformIO)

# O SCons não define __file__; descobrimos o caminho deste script pelo frame atual.
here = os.path.dirname(os.path.abspath(inspect.getframeinfo(inspect.currentframe()).filename))
runner = os.environ.get("HARDWARE_STUDIO_RUNNER") or os.path.normpath(os.path.join(here, "..", "avr-run.mjs"))
extra = os.environ.get("SIM_ARGS", "")
# build.mcu da placa (atmega328p no uno, atmega2560 no megaatmega2560); outro chip é recusado pelo emulador com o motivo.
mcu = env.BoardConfig().get("build.mcu", "auto")  # noqa: F821

env.AddCustomTarget(  # noqa: F821
    name="simulate",
    dependencies="$BUILD_DIR/${PROGNAME}.hex",
    actions=['node "%s" "$BUILD_DIR/${PROGNAME}.hex" --mcu %s %s' % (runner, mcu, extra)],
    title="Simulate",
    description="Dá boot no firmware no emulador AVR do Hardware Studio (Uno ou Mega 2560)",
)
