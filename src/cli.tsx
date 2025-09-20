#!/usr/bin/env node
import { render } from "ink";
import App from "./app.js";
import { StatusMessageProvider } from "./hooks/status-message.js";

render(
  <StatusMessageProvider>
    <App />
  </StatusMessageProvider>
);
