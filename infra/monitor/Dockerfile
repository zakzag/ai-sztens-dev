# AIsztens — API watchdog image.
# Minimal Alpine with curl so the script can poll the API and post alerts.

FROM alpine:3.20

RUN apk add --no-cache curl bash

WORKDIR /app
# `dos2unix` is intentionally NOT added to the apk layer — instead we
# strip the CRs in the COPY step. This is robust against editors that
# re-introduce CRLF (a 2026-10-02 live incident saw the kernel
# `execve`ing `/bin/sh\r` and returning ENOENT, which kept the monitor
# container in `Restarting (255)` until someone hand-fixed the image).
# `tr -d '\r'` is the lightest possible tool for the job and ships in
# busybox by default.
COPY watch.sh /tmp/watch.sh
RUN tr -d '\r' < /tmp/watch.sh > /app/watch.sh \
 && chmod +x /app/watch.sh \
 && rm -f /tmp/watch.sh

USER nobody

CMD ["/app/watch.sh"]
