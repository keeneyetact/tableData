import Bundler  from "./Bundler.js";

var bundler = new Bundler("5.0.6", process.env.TARGET);

module.exports = bundler.bundle();
