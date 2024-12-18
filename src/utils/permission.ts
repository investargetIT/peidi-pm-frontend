// 相关权限的判断
const isInArr = (val, arr) => {
  const item = arr.find(item => item.userId == val);
  return Boolean(item);
};

// isCreator
const isCreator = (val, obj) => {
  return val == obj.userId;
};

// 当前登陆人是否可以看任务
export const canViewTask = data => {
  // creator creatorAD contacters contactersad workerIds workerIdsAD
  let ddUserInfo = localStorage.getItem("ddUserInfo");
  let userId = ddUserInfo?.userid;
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  } else {
    return false;
  }
  const { contacters, contacterAds, creator, creatorAds, workers, workerAds } =
    data;
  return (
    isInArr(userId, contacters) ||
    isInArr(userId, contacterAds) ||
    isCreator(userId, creator) ||
    isInArr(userId, creatorAds) ||
    isInArr(userId, workers) ||
    isInArr(userId, workerAds)
  );
};

// 当前登陆人是否可以审核任务
export const canExamineTask = data => {
  // workerAds
  let ddUserInfo = localStorage.getItem("ddUserInfo");
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  } else {
    return false;
  }
  let userId = ddUserInfo?.userid;
  const { contacters, contacterAds, creator, creatorAds, workers, workerAds } =
    data;
  // return isInArr(userId, contacterAds)
  console.log("canExamineTask", userId, workerAds);
  // 测试是自己
  // return isInArr(userId, [{ userId }])
  return isInArr(userId, workerAds);
};

// 当前登陆人是否可以修改任务状态
export const canUpdateTaskStatus = data => {
  // worker workerAds
  let ddUserInfo = localStorage.getItem("ddUserInfo");
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  } else {
    return false;
  }
  let userId = ddUserInfo?.userid;
  const { contacters, contacterAds, creator, creatorAds, workers, workerAds } =
    data;
  // return isInArr(userId, contacterAds)
  console.log("canExamineTask", userId, workerAds);
  // 测试是自己
  // return isInArr(userId, [{ userId }])
  return isInArr(userId, workerAds) || isInArr(userId, workers);
};

// 是否可以新增任务记录
export const canAddTaskRecord = data => {
  // worker
  let ddUserInfo = localStorage.getItem("ddUserInfo");
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  } else {
    return false;
  }
  let userId = ddUserInfo?.userid;
  const { contacters, contacterAds, creator, creatorAds, workers, workerAds } =
    data;
  // return isInArr(userId, contacterAds)
  console.log("canExamineTask", userId, workerAds);
  // 测试是自己
  // return isInArr(userId, [{ userId }])
  return isInArr(userId, workers);
};

// 是否可以修改任务记录
export const canUpdateTaskRecord = data => {
  // worker workerAds
  let ddUserInfo = localStorage.getItem("ddUserInfo");
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  } else {
    return false;
  }
  let userId = ddUserInfo?.userid;
  const { contacters, contacterAds, creator, creatorAds, workers, workerAds } =
    data;
  // return isInArr(userId, contacterAds)
  console.log("canExamineTask", userId, workerAds);
  // 测试是自己
  // return isInArr(userId, [{ userId }])
  return isInArr(userId, workerAds) || isInArr(userId, workers);
};

// 是否可以修改期望日期
export const updateExpectData = data => {
  // creator creatorAD
  let ddUserInfo = localStorage.getItem("ddUserInfo");
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  } else {
    return false;
  }
  let userId = ddUserInfo?.userid;
  const { contacters, contacterAds, creator, creatorAds, workers, workerAds } =
    data;
  // return isInArr(userId, contacterAds)
  console.log("canExamineTask", userId, workerAds);
  // 测试是自己
  // return isInArr(userId, [{ userId }])
  return isCreator(userId, creator) || isInArr(userId, creatorAds);
};
