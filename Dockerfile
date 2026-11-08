FROM python:3.13-alpine AS build
WORKDIR /build
COPY generate_booklet.py generate_audio.py build_web.py ./
COPY web ./web
RUN python generate_booklet.py && python generate_audio.py && python build_web.py

FROM python:3.13-alpine
WORKDIR /site
COPY --from=build /build/dist /site
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/', timeout=2)" || exit 1
CMD ["python", "-m", "http.server", "8080", "--bind", "0.0.0.0", "--directory", "/site"]
