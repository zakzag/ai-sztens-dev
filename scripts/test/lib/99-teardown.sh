#!/usr/bin/env bash
# Callback Assistant — optional teardown helper.
#
# Sourced by stack-smoke.sh only when --down is passed. Currently the
# teardown logic is small enough to live directly in stack-smoke.sh, but
# keeping it in a separate file mirrors the 00/10/20 layout and gives us a
# single place to extend when the suite grows (e.g. dropping test-only
# networks, cleaning up port-forwards).
#
# Exports nothing; calls `dc down` from the prelude helpers.

teardown_stack() {
  dc down
}
