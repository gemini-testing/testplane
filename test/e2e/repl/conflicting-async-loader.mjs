import { register } from "node:module";

register("data:text/javascript,export async function load(url, context, nextLoad) { return nextLoad(url, context); }");
