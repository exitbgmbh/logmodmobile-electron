const getResponse = (code = 200, message = '', responseData = []) => {
    return {
        success: code === 200,
        code: code,
        message: message,
        response: responseData
    };
}

module.exports = getResponse;
