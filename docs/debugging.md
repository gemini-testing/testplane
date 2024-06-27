<!-- DOCTOC SKIP -->
## Debugging

### Tracing

Testpalne supports [OpenTelemetry](https://opentelemetry.io) standard for tracing. A randomly generated `traceparent` header is added to all requests. It is generated according to [w3c](https://www.w3.org/TR/trace-context/#traceparent-header) specification.

You can use `traceparent` to trace the execution of individual tests.

