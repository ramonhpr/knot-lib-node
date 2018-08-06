import meshblu from 'meshblu';
import isBase64 from 'is-base64';

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

async function getDeviceUuid(connection, id) {
  const devices = await getDevices(connection);
  const device = devices.find(d => d.id === id);
  if (!device) {
    throw new Error('Not found');
  }
  return device.uuid;
}

function parseValue(value) {
  if (isNaN(value)) { // eslint-disable-line no-restricted-globals
    if (value === 'true' || value === 'false') {
      return (value === 'true');
    }
    if (!isBase64(value)) {
      throw new Error('Supported types are boolean, number or Base64 strings');
    }
    return value;
  }

  return parseFloat(value);
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

  async getDevice(id) {
    const devices = await this.getDevices();
    const device = devices.find(d => d.id === id);
    if (!device) {
      throw new Error('Not found');
    }
    return device;
  }

  async setData(id, sensorId, value) {
    const parsedValue = parseValue(value); // throws if value is invalid
    const uuid = await getDeviceUuid(this.connection, id);
    return new Promise((resolve) => {
      this.connection.update({
        uuid,
        set_data: [{
          sensor_id: sensorId,
          value: parsedValue,
        }],
      }, () => {
        resolve();
      });
    });
  }

  async requestData(id, sensorId) {
    const uuid = await getDeviceUuid(this.connection, id);
    return new Promise((resolve) => {
      this.connection.update({
        uuid,
        get_data: [{ sensor_id: sensorId }],
      }, () => {
        resolve();
      });
    });
  }

  async subscribe(id, type) {
    const uuid = await getDeviceUuid(this.connection, id);
    return new Promise((resolve, reject) => {
      this.connection.subscribe({
        uuid,
        type: [type],
      }, (result) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve();
        }
      });
    });
  }

  on(event, callback) {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    this.connection.on(event, callback);
  }
}

export { Client }; // eslint-disable-line import/prefer-default-export
