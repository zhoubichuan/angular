let express = require("express");
let router = express.Router();
let jwt = require("jsonwebtoken");
let config = require("../config");
let checkLogin = require("../checkLogin");
let checkPermission = require("../checkPermission");
let moment = require("moment");
const { json } = require("body-parser");
["field", "type", "data", "template"].forEach((item) => {
  let templateData = require("../"+item);
  let getFileds = (key, state, data) => {
    let jsonArray = templateData[key + ".json"];
    let fieldObj = {};
    jsonArray.forEach((item) => {
      if (item[state]) {
        fieldObj[item.name] =
          data[item.name] || (state === "add" ? item["addDefault"] : "");
      }
    });
    return fieldObj;
  };

  Object.keys(templateData).forEach((key) => {
    key = key.replace('.json','');
    let Models = require("../model");
    // 添加规则
    router.post("/list/"+item+"/" + key, async (req, res) => {
      let currentId = "1";
      let preRow = await Models[item + key]
        .find({})
        .sort({ updatedAt: -1 })
        .limit(1);
      if (!preRow[0] || !preRow[0].id) {
        currentId = "0000001";
      } else {
        currentId = String(Number(preRow[0].id) + 1);
        currentId = "0".repeat(7 - currentId.length) + currentId;
      }
      let result = await Models[item+ key].create({
        ...getFileds(key, "add", req.body),
        id: currentId,
      });
      return res.json(result);
    });
    // 更新规则
    router.put("/list/"+item+"/" + key, async (req, res) => {
      let { id = 1 } = req.body;
      let target = await Models[item+ key].find({ id });
      if (!target.length) {
        res.send({ status: "error", message: "没有找到" });
        return;
      }
      let result = await Models[item+ key].updateMany(
        { id },
        { $set: getFileds(key, "edit", req.body) }
      );
      return res.json(result);
    });
    // 删除规则
    router.delete("/list/"+item+"/" + key, async (req, res) => {
      let { id } = req.body;
      let target = await Models[item+ key].find({
        $or: id.map((id) => ({ id })),
      });
      if (!target.length) {
        res.send({ status: "error", message: "没有找到" });
        return;
      }
      let result = await Models[item+ key].deleteMany({
        $or: target.map((item) => ({ id: item.id })),
      });
      return res.json(result);
    });
    //查询
    router.get("/list/"+item+"/" + key, async (req, res) => {
      let { current = 1, pageSize = 10, sorter, filter, ...query } = req.query;
      if (sorter) {
        sorter = sorter ? JSON.parse(sorter) : {};
        sorter[key] = sorter[key] === "ascend" ? 1 : -1;
      }
      if (filter) {
        filter = filter ? JSON.parse(filter) : {};
        for (let key in filter) {
          if (filter[key]) query[key] = filter[key];
        }
      }
      current = parseInt(current);
      pageSize = parseInt(pageSize);
      if (query && query.userip) {
        query.userip = new RegExp(query.userip);
      }
      let total = await Models[item+ key].countDocuments(query);
      let users = await Models[item+ key]
        .find(query)
        .sort(sorter)
        .skip((current - 1) * pageSize)
        .limit(pageSize);
      const result = {
        data: users,
        total,
        pageSize,
        current,
      };
      return res.json(result);
    });
  });
});

module.exports = router;
