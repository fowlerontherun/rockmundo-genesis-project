const CHARACTER_IDENTITY_FIELDS: Record<string, string> = {
  "profile-username": "character-public-username",
  "profile-display-name": "character-public-display-name",
};

const protectIdentityInput = (element: Element) => {
  if (!(element instanceof HTMLInputElement)) {
    return;
  }

  const safeName = CHARACTER_IDENTITY_FIELDS[element.id];
  if (!safeName) {
    return;
  }

  // These are public character identity fields, not authentication/profile
  // identity fields. Login/password managers must not inject account email or
  // a real-world account name into them.
  element.autocomplete = "off";
  element.name = safeName;
  element.setAttribute("data-form-type", "other");
  element.setAttribute("data-lpignore", "true");
  element.setAttribute("data-1p-ignore", "true");
};

const protectExistingFields = (root: ParentNode = document) => {
  for (const id of Object.keys(CHARACTER_IDENTITY_FIELDS)) {
    const element = root.querySelector(`#${id}`);
    if (element) {
      protectIdentityInput(element);
    }
  }
};

export const configureCharacterProfileAutofillProtection = () => {
  if (typeof document === "undefined") {
    return;
  }

  protectExistingFields();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }

        protectIdentityInput(node);
        protectExistingFields(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
};
