# Plant Information Dashboard — frontend app image
# Multi-stage: build with Node, serve with nginx.

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_DATA_SOURCE=api
ARG VITE_API_URL=/api/v1
ARG VITE_GIT_SHA=
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GIT_SHA=$VITE_GIT_SHA

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
