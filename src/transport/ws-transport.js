"use strict";

var AbstractTransport = require("./abstract-transport");
var WebSocketClient = require("../platform/web-socket-client");

function WsTransport(address, timeout, messageHandler, initialConnectCallback) {
  AbstractTransport.call(this, address, timeout, messageHandler);
  this.initialConnect(initialConnectCallback);
}

WsTransport.prototype = Object.create(AbstractTransport.prototype);

WsTransport.prototype.constructor = WsTransport;

WsTransport.prototype.connect = function (callback) {
  var messageHandler, self = this;
  this.webSocketClient = new WebSocketClient(this.address, undefined, undefined, undefined, { timeout: this.timeout });
  messageHandler = function () { };
  this.webSocketClient.onopen = function () {
    callback(null);
    callback = function () { };
    messageHandler = this.messageHandler;
  }.bind(this);
  this.webSocketClient.onmessage = function (message) {
    messageHandler(null, JSON.parse(message.data));
  };
  this.webSocketClient.onerror = function () {
    // unfortunately, we get no error details:
    // https://www.w3.org/TR/websockets/#concept-websocket-close-fail
    messageHandler(new Error("Web socket error."), null);
  };
  this.webSocketClient.onclose = function (event) {
    if (event && event.code !== 1000) {
      console.error("websocket", self.address, "closed:", event.code, event.reason);
      var keys = Object.keys(self.disconnectListeners);
      var listeners = self.disconnectListeners;
      keys.forEach(function (key) {
        return listeners[key]();
      });
      callback(new Error("Web socket closed without opening, usually means failed connection."));
    }
    callback = function () { };
  };
};

WsTransport.prototype.submitRpcRequest = function (rpcJso, errorCallback) {
  try {
    if (this.webSocketClient.readyState === 3) {
      var err = new Error("Websocket Disconnected"); err.retryable = true;
      return errorCallback(err);
    }
    this.webSocketClient.send(JSON.stringify(rpcJso));
  } catch (error) {
    if (error.code === "INVALID_STATE_ERR") error.retryable = true;
    if (error.message === "cannot call send() while not connected") error.retryable = true;
    errorCallback(error);
  }
};

module.exports = WsTransport;
