import { createCollectionRoutes } from './collections.mjs';

export const createRecordRoutes = (deps) => {
  // Reuse existing record handlers from collections routes to keep runtime behavior identical.
  const collectionRoutes = createCollectionRoutes(deps);

  const {
    createRecord,
    searchProjectRecords,
    convertRecord,
    listSubtasks,
    updateRecord,
    getRecord,
    updateRecordValues,
    createRecordRelation,
    deleteRelation,
  } = collectionRoutes;

  return {
    createRecord,
    searchProjectRecords,
    convertRecord,
    listSubtasks,
    updateRecord,
    getRecord,
    updateRecordValues,
    createRecordRelation,
    deleteRelation,
  };
};
