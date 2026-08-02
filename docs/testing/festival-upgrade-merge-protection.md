# Festival upgrade merge protection

Festival upgrade pull requests must remain drafts until the repository owner has
reviewed the completed workflow results. A queued or in-progress workflow is not
certification, and cleanup or diagnostic-artifact steps do not replace a failed
gate.

Protect the target branch by requiring these checks:

- **CI / lint**
- **CI / typecheck**
- **CI / test**
- **CI / build**
- **Festival & Touring Integration Gate / Touring integration**
- **Festival & Touring Integration Gate / Festival static certification, lint and build**
- **Festival & Touring Integration Gate / database-lifecycle**

Before converting the PR from draft, confirm every required workflow conclusion
is `success`, both disposable-database resets and certification passes ran, and
the diagnostics artifact is available. Do not enable auto-merge to bypass this
review point. Annual upgrade charging remains a separate, deferred change.
