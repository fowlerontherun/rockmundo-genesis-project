const BASE_PATH = "/api/national-selections";

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.message === "string") {
      return data.message;
    }
  } catch (_) {
    // Fall through to a default message
  }

  return `Request failed with status ${response.status}`;
};

export const getActiveNationalSelectionYear = async (): Promise<number> => {
  const response = await fetch(`${BASE_PATH}/active-year`);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as { activeYear?: number; year?: number };
  return payload.activeYear ?? payload.year ?? new Date().getFullYear();
};

export const triggerNationalSelections = async (year: number) => {
  const response = await fetch(`${BASE_PATH}/${year}/random-selection`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  try {
    return await response.json();
  } catch (_) {
    return null;
  }
};
