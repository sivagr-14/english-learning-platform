FROM node:20-alpine
WORKDIR /app

COPY package.json yarn.lock* ./
# Ensure devDependencies (ts-node-dev) are available inside the image
ENV NODE_ENV=development
RUN yarn install --frozen-lockfile --production=false || yarn install --production=false

COPY . .

# Ensure tsc is available for building (install globally as a fallback)
# Ensure a compatible TypeScript version is available for building
# Install the project's TypeScript version into node_modules (no-save)
# Build the TypeScript sources and run the compiled app
EXPOSE 5000
# Run dev server inside the container so ts-node-dev from devDependencies is used
CMD ["yarn", "dev"]
