import visionHTML from '../templates/vision.html?raw';
import monthHTML from '../templates/month.html?raw';

export const templates = {
    vision: {
        html: visionHTML,
        requiredFields: ['managerName', 'bakeryLocation', 'quarter', 'quarterlyTheme', 'month1Goal', 'month2Goal', 'month3Goal']
    },
    month: (monthNum) => {
        // Replace placeholders in the month template
        return monthHTML.replace(/\$\{monthNum\}/g, monthNum);
    }
};
