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

env.AddCustomTarget(  # noqa: F821
    name="simulate",
    dependencies="$BUILD_DIR/${PROGNAME}.hex",
    actions=['node "%s" "$BUILD_DIR/${PROGNAME}.hex" %s' % (runner, extra)],
    title="Simulate",
    description="Dá boot no firmware no emulador ATmega328P do Hardware Studio",
)
