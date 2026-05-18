FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    latexmk \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-lang-european \
    texlive-lang-portuguese \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV WORK_DIR=/tmp/gerador-prova-work
ENV API_KEYS_FILE=/app/data/api-keys.json

RUN mkdir -p /tmp/gerador-prova-work /app/data

EXPOSE 3000

CMD ["node", "src/index.js"]
