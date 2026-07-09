// ============================================================
// 原始版本（保留对比，存在 bug，见下方讲解）
// 主要问题：
// 1. result[index] 的 index 用的是共享变量 queueIndex（启动计数），
//    而不是"当前完成任务"自己在 tasks 中的原始下标，导致结果顺序错乱、
//    甚至互相覆盖。
// 2. 没有处理 tasks.length === 0 的情况，会导致 resolve 永远不被调用。
// 3. 没有 reject/异常处理，一个任务失败会导致整个调度器挂死。
// ============================================================
function limitConcurrencyBuggy(tasks, limit) {
    return new Promise((resolve, reject) => {
        if (tasks.length === 0) {
            resolve([]);
            return;
        }
        let queueIndex = 0;
        let resCot = 0;
        const result = [];

        const resultRes = (res, index) => {
            resCot++;
            result[index] = res;
            const task = tasks[index];
            const currentIndex = queueIndex++;
            if (task) {
                task().then((re) => {
                    resultRes(re, currentIndex);
                }).catch((err) => {
                    reject(err);
                });
            } else if (resCot === tasks.length) {
                resolve(result);
            }
        }

        for (let i = 0; i < limit && i < tasks.length; i++) {
            const task = tasks[i];
            queueIndex++;
            task().then((re) => {
                const currentIndex = i
                resultRes(re, currentIndex);
            }).catch((err) => {
                reject(err);
            });
        }
    })


}

// ============================================================
// 正确实现：带并发限制的异步任务调度器
// 核心思路：
// 1. 用游标 nextIndex 记录"下一个待启动的原始任务下标"，
//    每个任务完成时用自己闭包捕获的 index 写回 result，
//    保证 result 顺序与 tasks 输入顺序一致（与完成顺序无关）。
// 2. 用 finishedCount 计数已完成任务数，等于 tasks.length 时统一 resolve。
// 3. 支持 reject：任意任务失败，立即 reject 整个调度器（类似 Promise.all 语义）。
//    如果业务需要"某个任务失败不影响其他任务"，可以把 reject 换成把错误
//    存进 result，自行改造即可（见下方 settled 版本注释）。
// 4. 处理边界情况：tasks.length === 0、limit <= 0、limit >= tasks.length。
// ============================================================
function limitConcurrency(tasks, limit) {
    return new Promise((resolve, reject) => {
        const total = tasks.length;
        if (total === 0) {
            resolve([]);
            return;
        }

        const result = new Array(total);
        let nextIndex = 0;      // 下一个待启动任务在 tasks 中的下标
        let finishedCount = 0;  // 已完成任务数
        let hasSettled = false; // 防止 reject 后继续 resolve/reject

        const runTask = () => {
            if (hasSettled) return;
            if (nextIndex >= total) return; // 没有更多任务可启动

            const curIndex = nextIndex; // 用局部变量捕获，避免闭包共享变量的坑
            nextIndex++;
            const task = tasks[curIndex];

            Promise.resolve()
                .then(() => task())
                .then((res) => {
                    if (hasSettled) return;
                    result[curIndex] = res; // 用任务自己的原始下标写回，保证顺序正确
                    finishedCount++;

                    if (finishedCount === total) {
                        hasSettled = true;
                        resolve(result);
                        return;
                    }
                    runTask(); // 完成一个，补一个进来
                })
                .catch((err) => {
                    if (hasSettled) return;
                    hasSettled = true;
                    reject(err); // 任一任务失败，整体失败（可按需改造成 settled 版本）
                });
        };

        const workerCount = Math.min(limit, total);
        for (let i = 0; i < workerCount; i++) {
            runTask();
        }
    });
}

// 让每个任务返回可辨识的值，方便验证 result 顺序是否正确
const sleep = (time) => {
  return () => new Promise((resolve) => {
    setTimeout(() => {
      console.log('sleep start', time);
      resolve(`sleep-${time}`);
    }, time);
  });
}

const task = (index) => {
  return () => new Promise((resolve) => {
    console.log('task run', index);
    resolve(`task-${index}`);
  });
}

const tasks = [sleep(1000), sleep(2000), sleep(3000), task(1), task(2)];

// 验证：无论完成顺序如何（谁先 resolve），result 数组顺序应与 tasks 输入顺序一致
limitConcurrency(tasks, 2).then((result) => {
  console.log('【正确版】result =', result);
  // 期望输出: ['sleep-1000', 'sleep-2000', 'sleep-3000', 'task-1', 'task-2']
});

// 对比：原始 buggy 版本，result 顺序会因为完成顺序不同而错乱
limitConcurrencyBuggy(tasks.map((t) => t), 2).then((result) => {
  console.log('【原始版】result =', result);
});

