import meshblu from 'meshblu';

function createConnection(hostname, port, uuid, token) {
  return meshblu.createConnection({
    server: hostname,
    port,
    uuid,
    token,
  });
}

function connect(hostname, port, uuid, token) {
  return new Promise((resolve, reject) => {
    const connection = createConnection(hostname, port, uuid, token);

    connection.on('ready', () => {
      resolve(connection);
    });

    connection.on('notReady', () => {
      connection.close(() => {});
      reject(new Error('Connection not authorized'));
    });
  });
}

function mapDevice(device) {
  return {
    id: device.id,
    name: device.name,
    status: device.status,
    schema: device.schema,
  };
}

function getDevices(connection) {
  return new Promise((resolve, reject) => {
    if (!connection) {
      reject(new Error('Not connected'));
      return;
    }

    connection.devices({ gateways: ['*'] }, (result) => {
      if (result.error) {
        reject(result.error);
        return;
      }

      resolve(result);
    });
  });
}

class Client {
  constructor(hostname, port, uuid, token) {
    this.hostname = hostname;
    this.port = port;
    this.uuid = uuid;
    this.token = token;
  }

  async connect() {
    if (this.connection) {
      return;
    }

    this.connection = await connect(this.hostname, this.port, this.uuid, this.token);
  }

  async close() {
    return new Promise((resolve) => {
      if (!this.connection) {
        resolve();
        return;
      }

      this.connection.close(() => {
        this.connection = null;
        resolve();
      });
    });
  }

  async getDevices() {
    const devices = await getDevices(this.connection);
    return devices.map(mapDevice);
  }
}

export { Client }; // eslint-disable-line import/prefer-default-export
