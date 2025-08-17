FROM node:18-alpine
WORKDIR /app
# Install git (needed for gh-pages)
RUN apk add --no-cache git
RUN git config --global user.email "lijojose43@gmail.com" \
    && git config --global user.name "Lijo Jose"
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
