FROM amd64/node:18.17 AS builder

WORKDIR /srv

RUN yarn -v
COPY . .
RUN yarn --ignore-engines

RUN yarn build

# use lighter image
FROM amd64/node:18.17-slim
COPY --from=builder /srv .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build/index.js"]