const catchError = require('../utils/catchError');
const ProgramasSuperiores = require('../models/ProgramasSuperiores');

const getAll = catchError(async(req, res) => {
    const results = await ProgramasSuperiores.findAll();
    return res.json(results);
});

const create = catchError(async(req, res) => {
    const result = await ProgramasSuperiores.create(req.body);
    return res.status(201).json(result);
});

const getOne = catchError(async(req, res) => {
    const { id } = req.params;
    const result = await ProgramasSuperiores.findByPk(id);
    if(!result) return res.sendStatus(404);
    return res.json(result);
});

const remove = catchError(async(req, res) => {
    const { id } = req.params;
    await ProgramasSuperiores.destroy({ where: {id} });
    return res.sendStatus(204);
});

const update = catchError(async(req, res) => {
    const { id } = req.params;
    const result = await ProgramasSuperiores.update(
        req.body,
        { where: {id}, returning: true }
    );
    if(result[0] === 0) return res.sendStatus(404);
    return res.json(result[1][0]);
});

module.exports = {
    getAll,
    create,
    getOne,
    remove,
    update
}