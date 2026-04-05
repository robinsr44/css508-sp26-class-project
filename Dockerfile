FROM ubuntu:22.04

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install basic utilities (optional but useful)
RUN apt-get update && \
    apt-get install -y bash curl && \
    apt-get clean

# Set working directory
WORKDIR /app

# Default command (just keeps container running)
CMD ["bash"]