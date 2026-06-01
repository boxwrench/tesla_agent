# Sandbox image for realdata-eval agent runs — the "agent toolbox".
#
# Extends the Hermes default terminal image with the libraries an agent
# should reasonably have to do operational data analysis on plant
# historian exports. We bake these in rather than make the agent
# pip-install at runtime — "don't be too tough on the agent": we test
# its analysis reasoning, not its ability to fight an unprovisioned
# environment.
#
# See README.md in this directory for what each library is for and why
# it's in the standard kit.
#
# Build:
#   docker build -t hermes-realdata-eval:latest \
#     docs/projects/realdata-eval/sandbox
#
# Wired into ~/.hermes/config.yaml -> terminal.docker_image for eval
# runs. The data dir is mounted read-only at /data via docker_volumes.
FROM nikolaik/python-nodejs:python3.11-nodejs20

# The standard operational-analyst toolbox. Keep this list curated and
# justified (see README) — not a kitchen sink.
RUN pip install --no-cache-dir \
      pandas==2.2.* \
      numpy \
      pyarrow \
      scipy \
      matplotlib \
      openpyxl \
      tabulate

# Sanity: fail the build if any toolbox library isn't importable.
RUN python3 -c "import pandas, numpy, pyarrow, scipy, matplotlib, openpyxl, tabulate; \
print('toolbox OK — pandas', pandas.__version__)"
