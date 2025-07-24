const getResponse = (code = 200, message = '', responseData = []) => {
    return {
        success: code === 200,
        code: code,
        message: message,
        response: responseData
    };
}

const getMockResponse = (response, error) => {
    if (error) {
        response.send(getResponse(500, 'some error message'));
        return;
    }

    response.send(getResponse(200));
}

module.exports = {
    getResponse,
    getMockResponse
};
