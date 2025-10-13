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
    result.push(item.emplId || item.userId);
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

export function splitTaskType(val){
  let arr = val.split('&');
  return {
    value : arr[0],
    priority : arr[1]
  }
}

// 判断是否是外部承接人
export function isExternalTask(id) {
  const externalTask = localStorage.getItem('workerExEnum');
  if (!externalTask) return false;
  const externalTaskArr = JSON.parse(externalTask);
  return externalTaskArr.some(item => item.id === id);
}
