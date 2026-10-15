import { useCallback, useEffect, useRef, useState } from "react";

import { callListModels } from "@/lib/repositories/models";
import type { ModelOption } from "@/lib/repositories/types";

export type ModelCatalog = {
  options: ModelOption[];
  state: "idle" | "loading" | "ready" | "error";
  load: () => void;
};

export function useModelCatalog(): ModelCatalog {
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [state, setState] = useState<ModelCatalog["state"]>("idle");
  const requested = useRef(false);

  const load = useCallback(() => {
    if (requested.current) {
      return;
    }
    requested.current = true;
    setState("loading");
    callListModels()
      .then((next) => {
        setOptions(next);
        setState("ready");
      })
      .catch(() => {
        requested.current = false;
        setOptions([]);
        setState("error");
      });
  }, []);

  return { options, state, load };
}

export function useModels(): {
  models: ModelOption[];
  loading: boolean;
} {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    callListModels()
      .then((next) => {
        if (!cancelled) setModels(next);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, loading };
}
