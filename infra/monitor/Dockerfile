# Callback Assistant — API watchdog image.
# Minimal Alpine with curl so the script can poll the API and post alerts.

FROM alpine:3.20

RUN apk add --no-cache curl bash

WORKDIR /app
COPY watch.sh /app/watch.sh
RUN chmod +x /app/watch.sh

USER nobody

CMD ["/app/watch.sh"]
