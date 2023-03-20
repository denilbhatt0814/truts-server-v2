class WhereClause {
  constructor(base, bigQ) {
    this.base = base;
    this.bigQ = bigQ;
  }

  // search
  search() {
    const searchword = this.bigQ.search
      ? {
          name: {
            $regex: this.bigQ.search,
            $option: "i",
          },
        }
      : {};

    this.base = this.base.find({ ...searchword });
    return this;
  }

  // pagination
  async pager(resultperpage) {
    let currentPage = 1;
    if (this.bigQ.page) {
      currentPage = this.bigQ.page;
    }

    const skipVal = resultperpage * (currentPage - 1);

    const count = await this.base.lean().countDocuments(); // use lean() to return plain JavaScript objects
    const totalPages = Math.ceil(count / resultperpage);

    this.base = this.base.lean().limit(resultperpage).skip(skipVal);
    return { results: await this.base.exec(), count, totalPages };
  }

  // sort
  sort() {
    if (this.bigQ.sort) {
      const sort = JSON.parse(this.bigQ.sort);
      this.base = this.base.sort(sort);
      return this;
    } else {
      this.base = this.base.sort({ _id: 1 });
      return this;
    }
  }

  // filter
  filter() {
    const copyQ = { ...this.bigQ };
    delete copyQ["search"];
    delete copyQ["limit"];
    delete copyQ["page"];

    let stringOfCopyQ = JSON.stringify(copyQ);
    stringOfCopyQ = stringOfCopyQ.replace(
      /\b(gte|lte|gt|lt)\b/g,
      (m) => `$${m}`
    );

    const jsonOfCopyQ = JSON.parse(stringOfCopyQ);
    Object.keys(jsonOfCopyQ).forEach((key) => {
      const val = jsonOfCopyQ[key];
      if (Array.isArray(val)) {
        jsonOfCopyQ[key] = { $in: val };
      }
    });

    this.base = this.base.find(jsonOfCopyQ);
    return this;
  }
}

module.exports = WhereClause;
