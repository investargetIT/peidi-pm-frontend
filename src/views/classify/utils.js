export function removeDuplicates(arr) {
  const seen = new Object();
  const result = [];
  for (const item of arr) {
    const value = item.value;
    if (!seen[value]) {
      seen[value] = true;
      result.push(item);
    }
  }
  return result;
}

export function extractEmplId(arr) {
  const result = [];
  for (const item of arr) {
    result.push(item.emplId);
  }
  return result;
}

export function extractInfo(str) {
  const parts = str.split("/");
  const [nameAndFiles, workerMasterId] = parts;
  const nameAndFilesArr = nameAndFiles.split("#");
  const name = nameAndFilesArr[0];
  const filenames = nameAndFilesArr.slice(1);

  return {
    name: name,
    filename: filenames,
    workerMasterId: workerMasterId
  };
}
