import { bridgeMissingError, getBridge } from "@/lib/bridge";
import type { ModelOption } from "./types";

export async function callListModels(): Promise<ModelOption[]> {
  const bridge = getBridge();
  if (!bridge?.ListModels) {
    throw bridgeMissingError();
  }
  return await bridge.ListModels();
}
