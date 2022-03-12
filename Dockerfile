FROM node:14.15.5-alpine

WORKDIR /client

# RUN mkdir client

# RUN ls -lart

# RUN pwd

COPY /client/package.json .
COPY /client/package-lock.json .

# RUN cd /client

RUN npm install -g @angular/cli@12.0.1
RUN npm install

# RUN cd ..

COPY /client/. .

RUN export NODE_OPTIONS=--openssl-legacy-provider
# RUN cd /client
RUN ng build

# RUN pwd

# RUN ls -lart

# RUN cd ..

# RUN mkdir backend

WORKDIR /backend

COPY /backend/package.json .
COPY /backend/package-lock.json .

RUN npm install

COPY /backend/. .

RUN pwd

RUN cp -R /client/dist/client /backend/public/.

EXPOSE 3000

ENTRYPOINT npm run start