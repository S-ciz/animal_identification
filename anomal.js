import axios from "axios"
import fs from "fs"
import FormData from "form-data"


export async function AnomalPrediction(image) {
      const form = new FormData();

    form.append("image", image.buffer, {
        filename: image.originalname,
        contentType: image.mimetype
    });

    const response = await axios.post(
        "http://127.0.0.1:3000/predict",
        form,
        {
            headers: form.getHeaders()
        }
    );

    return response.data;
}

// predict("./animal.jpg")
//     .then(console.log)
//     .catch(console.error);
